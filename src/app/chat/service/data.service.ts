import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/internal-compatibility';
import { Message } from 'src/app/types/message';

export const WS_ENDPOINT = 'ws://localhost:8081';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  private socket$: WebSocketSubject<Message>;
  private messagesSubject = new Subject<Message>();
  public messages$ = this.messagesSubject.asObservable();

  constructor() { }

  public connect(): void {
    this.socket$ = this.getNewWebSocket();
    this.socket$.subscribe(msg => {
      console.log('Recieved message of type ', msg.type);
      this.messagesSubject.next(msg);
    })
  }

  getNewWebSocket(): WebSocketSubject<Message> {
    return webSocket({
      url: WS_ENDPOINT,
      openObserver: {
        next: () => {
          console.log('DataService: connection OK');

        }
      },
      closeObserver: {
        next: () => {
          console.log('DataService: connection closed');
          this.socket$.unsubscribe();
          this.connect();
        }
      }
    })
  }

  sendMessage(msg: Message): void {
    console.log('sending message: ', msg.type);
    this.socket$.next(msg);
  }

}
