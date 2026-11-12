import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CalendarConnection,
  ConnectionProvider,
  ConnectionStatus,
  Prisma,
  SyncStatus,
} from '@prisma/client';
import { google } from 'googleapis';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type CallbackParams = {
  code: string;
  state?: string;
};

type WebhookPayload = {
  channelId?: string;
  resourceId?: string;
  resourceState?: string;
  messageNumber?: string;
  channelToken?: string;
  body: unknown;
};

type AuthState = {
  userId: string;
  nonce: string;
};

@Injectable()
export class GoogleCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  getAuthorizationUrl(userId: string) {
    const client = this.createOAuthClient();
    const state = this.encodeState({ userId, nonce: randomUUID() });
    const scopes = this.getScopes();

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state,
    });

    return {
      provider: 'google',
      userId,
      scopes,
      authUrl,
      state,
    };
  }

  async handleOAuthCallback({ code, state }: CallbackParams) {
    if (!code) {
      throw new BadRequestException('缺少 Google OAuth 回调 code');
    }

    const authState = this.decodeState(state);
    const client = this.createOAuthClient();
    const { tokens } = await client.getToken(code);

    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const profile = await oauth2.userinfo.get();
    const accountId = profile.data.id ?? profile.data.email;

    if (!accountId || !profile.data.email) {
      throw new BadRequestException('无法从 Google 返回结果中识别用户信息');
    }

    const connection = await this.prisma.calendarConnection.upsert({
      where: {
        userId_provider: {
          userId: authState.userId,
          provider: ConnectionProvider.GOOGLE,
        },
      },
      create: {
        userId: authState.userId,
        provider: ConnectionProvider.GOOGLE,
        providerAccountId: accountId,
        status: ConnectionStatus.ACTIVE,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope,
        meta: {
          email: profile.data.email,
          name: profile.data.name,
          picture: profile.data.picture,
        },
      },
      update: {
        providerAccountId: accountId,
        status: ConnectionStatus.ACTIVE,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope,
        meta: {
          email: profile.data.email,
          name: profile.data.name,
          picture: profile.data.picture,
        },
      },
    });

    const calendars = await this.pullAndStoreCalendars(connection, client);
    await this.writeSyncLog({
      userId: authState.userId,
      action: 'google_oauth_callback',
      status: SyncStatus.SUCCESS,
      payload: {
        email: profile.data.email,
        calendarsSynced: calendars.length,
      },
    });

    return {
      success: true,
      provider: 'google',
      userId: authState.userId,
      account: {
        email: profile.data.email,
        name: profile.data.name,
      },
      calendars,
    };
  }

  async getConnectionStatus(userId: string) {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: ConnectionProvider.GOOGLE,
        },
      },
      include: {
        calendars: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return {
      provider: 'google',
      connected: Boolean(connection),
      connection,
    };
  }

  async listConnectedCalendars(userId: string) {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: ConnectionProvider.GOOGLE,
        },
      },
      include: {
        calendars: {
          orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        },
      },
    });

    return {
      provider: 'google',
      userId,
      items: connection?.calendars ?? [],
    };
  }

  async disconnect(userId: string) {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: ConnectionProvider.GOOGLE,
        },
      },
    });

    if (!connection) {
      return {
        success: true,
        provider: 'google',
        userId,
        disconnected: false,
      };
    }

    await this.prisma.calendar.updateMany({
      where: {
        connectionId: connection.id,
      },
      data: {
        syncEnabled: false,
      },
    });

    await this.prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        status: ConnectionStatus.REVOKED,
        accessToken: null,
        refreshToken: null,
      },
    });

    await this.writeSyncLog({
      userId,
      action: 'google_disconnect',
      status: SyncStatus.SUCCESS,
      payload: { connectionId: connection.id },
    });

    return {
      success: true,
      provider: 'google',
      userId,
      disconnected: true,
    };
  }

  async handleWebhook(payload: WebhookPayload) {
    await this.writeSyncLog({
      userId: this.decodeChannelToken(payload.channelToken)?.userId ?? 'unknown',
      action: 'google_webhook_received',
      status: SyncStatus.SUCCESS,
      payload: this.toJsonValue({
        channelId: payload.channelId ?? null,
        resourceId: payload.resourceId ?? null,
        resourceState: payload.resourceState ?? null,
        messageNumber: payload.messageNumber ?? null,
        channelToken: payload.channelToken ?? null,
        body: this.toJsonValue(payload.body),
      }),
    });

    return {
      ok: true,
      provider: 'google',
      received: true,
      resourceState: payload.resourceState ?? 'unknown',
    };
  }

  private async pullAndStoreCalendars(connection: CalendarConnection, authClient: ReturnType<typeof this.createOAuthClient>) {
    const calendarApi = google.calendar({ version: 'v3', auth: authClient });
    const response = await calendarApi.calendarList.list();
    const items = response.data.items ?? [];

    const persisted = [];

    for (const item of items) {
      if (!item.id || !item.summary) {
        continue;
      }

      const calendar = await this.prisma.calendar.upsert({
        where: {
          connectionId_providerCalendarId: {
            connectionId: connection.id,
            providerCalendarId: item.id,
          },
        },
        create: {
          userId: connection.userId,
          connectionId: connection.id,
          provider: ConnectionProvider.GOOGLE,
          providerCalendarId: item.id,
          name: item.summary,
          color: item.backgroundColor ?? null,
          isPrimary: Boolean(item.primary),
          isSelected: true,
          readOnly: item.accessRole === 'reader' || item.accessRole === 'freeBusyReader',
          syncEnabled: true,
        },
        update: {
          name: item.summary,
          color: item.backgroundColor ?? null,
          isPrimary: Boolean(item.primary),
          readOnly: item.accessRole === 'reader' || item.accessRole === 'freeBusyReader',
          syncEnabled: true,
        },
      });

      persisted.push(calendar);
    }

    return persisted;
  }

  private createOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Google OAuth 环境变量未配置完整');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getScopes() {
    const raw = process.env.GOOGLE_CALENDAR_SCOPES;

    if (!raw) {
      return [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ];
    }

    return raw
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  private encodeState(payload: AuthState) {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeState(state?: string): AuthState {
    if (!state) {
      return { userId: 'demo-user-1', nonce: randomUUID() };
    }

    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as AuthState;

      if (!decoded.userId) {
        throw new Error('invalid_state');
      }

      return decoded;
    } catch {
      throw new BadRequestException('Google OAuth state 非法或已损坏');
    }
  }

  private decodeChannelToken(channelToken?: string) {
    if (!channelToken) {
      return null;
    }

    const params = new URLSearchParams(channelToken);
    const userId = params.get('userId');

    if (!userId) {
      return null;
    }

    return { userId };
  }

  private async writeSyncLog(input: {
    userId: string;
    action: string;
    status: SyncStatus;
    payload?: Prisma.InputJsonValue;
  }) {
    if (input.userId === 'unknown') {
      return;
    }

    await this.prisma.syncLog.create({
      data: {
        userId: input.userId,
        provider: ConnectionProvider.GOOGLE,
        direction: 'INTERNAL',
        action: input.action,
        resourceType: 'google_calendar_integration',
        status: input.status,
        payload: input.payload,
      },
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    if (value === null) {
      return 'null';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.toJsonValue(item));
    }

    if (typeof value === 'object') {
      const result: Record<string, Prisma.InputJsonValue> = {};

      for (const [key, entry] of Object.entries(value)) {
        result[key] = this.toJsonValue(entry);
      }

      return result;
    }

    return String(value);
  }
}
