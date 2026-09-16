import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';

@Controller('events')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse()
  events(): Observable<MessageEvent> {
    const heartbeat = interval(25_000).pipe(map(() => ({ type: 'heartbeat', data: { timestamp: Date.now() } })));
    return merge(this.realtime.stream(), heartbeat);
  }
}
