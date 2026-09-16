import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class RealtimeService {
  private readonly events = new Subject<MessageEvent>();

  stream(): Observable<MessageEvent> { return this.events.asObservable(); }

  publish(type: string, data: Record<string, unknown>): void {
    this.events.next({ type, data, retry: 5000 });
  }
}
