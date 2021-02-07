import { Socket as OriginalSocket } from "socket.io";
export interface Socket extends OriginalSocket {
	userId?: string;
}
