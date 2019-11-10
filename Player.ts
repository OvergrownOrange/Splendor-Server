import { connection } from "websocket";
import { Lobby } from './Lobby'
    
var nextUserID = 1;

export class Player {
    id: number
    name: String
    connection: connection
    ready: Boolean
    lobby: Lobby
    score: Number

    constructor(name: String, connection: connection) {
        this.name = name
        this.id = nextUserID++
        this.connection = connection
        this.ready = false
        this.lobby = new Lobby("Null Lobby", 1)
        this.score = 0
    }

    toJson() {
        return {
            name: this.name,
            ready: this.ready
        }
    }
}