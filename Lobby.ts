var nextLobbyID = 1;

import { players } from './ServerMain'
import { Player } from './Player'
import { Message } from './Message'

export class Lobby {
    id: number
    name: String
    inGame: Boolean
    playerCount: number = 0
    maxPlayers: number
    players: Player[] = []
    chat: Message[] = []

    constructor(
        name: String,
        maxPlayers: number
    ) {
        this.id = maxPlayers == 1 ? 0 : nextLobbyID++       //Assign the 0 ID for a single player null lobby
        this.name = name
        this.inGame = false
        this.maxPlayers = maxPlayers
        this.chat.push(new Message("Server",'Welcome to '+this.name))
    }

    AddPlayer(player: Player) {
        if(this.playerCount < this.maxPlayers) {
            this.playerCount = this.players.push(player)    //Add the player to the lobby
            player.lobby = this                             //Assign this lobby to that player
        }
        
    }

    RemovePlayer(player: Player) {
        const index = this.players.indexOf(player,0)
        if(index > -1) {        //We have found the player in this lobby, proceed to remove
            this.players.splice(index,1)
            this.playerCount = this.players.length
            player.lobby = new Lobby("Null Lobby", 1)
        }
    }

    toJson() {
        let jsonPlayers = []
        this.players.forEach(player => {
            jsonPlayers.push(player.toJson())
        });
        return {
            id: this.id,
            name: this.name,
            playerCount: this.playerCount,
            maxPlayers: this.maxPlayers,
            players: jsonPlayers
        }
    }
}