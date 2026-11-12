import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';

@Controller('integrations/google')
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('connect')
  getConnectUrl(@Query('userId') userId = 'demo-user-1') {
    return this.googleCalendarService.getAuthorizationUrl(userId);
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Query('state') state?: string) {
    return this.googleCalendarService.handleOAuthCallback({ code, state });
  }

  @Get('status/:userId')
  async getStatus(@Param('userId') userId: string) {
    return this.googleCalendarService.getConnectionStatus(userId);
  }

  @Get('calendars/:userId')
  async getCalendars(@Param('userId') userId: string) {
    return this.googleCalendarService.listConnectedCalendars(userId);
  }

  @Post('disconnect/:userId')
  async disconnect(@Param('userId') userId: string) {
    return this.googleCalendarService.disconnect(userId);
  }

  @Post('webhook')
  async receiveWebhook(
    @Headers('x-goog-channel-id') channelId: string | undefined,
    @Headers('x-goog-resource-id') resourceId: string | undefined,
    @Headers('x-goog-resource-state') resourceState: string | undefined,
    @Headers('x-goog-message-number') messageNumber: string | undefined,
    @Headers('x-goog-channel-token') channelToken: string | undefined,
    @Body() body: unknown,
  ) {
    return this.googleCalendarService.handleWebhook({
      channelId,
      resourceId,
      resourceState,
      messageNumber,
      channelToken,
      body,
    });
  }
}
