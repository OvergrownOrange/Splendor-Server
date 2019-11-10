#!/usr/bin/env node
import { server, connection } from "websocket";
import { Lobby } from './Lobby'
import { Player } from './Player'
import { Message } from './Message'
import { Game } from './Game'
import { isNullOrUndefined } from "util";



enum Packet {
    Login = 1,
    LobbyList = 2,
    Lobby = 3,
    NewLobby = 4,
    JoinLobby = 5,
    LeaveLobby = 6,
    Message = 7,
    Ready = 8,
    StartGame = 9,
    QuitGame = 10
}


var http = require('http');
 
var httpServer = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
httpServer.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});
 
const wsServer = new server({
    httpServer,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});
 
function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}


export var lobbies: Array<Lobby> = [];
export var players: Array<Player> = []


wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    
    
    //Connection made and accepted
    var connection = request.accept(null, request.origin);
    console.log((new Date()) + ' Connection accepted.');
    console.log('Number of current connections: '+wsServer.connections.length)


    function sendLobbyList(con: connection) {
        let jsonLobbies = []
        lobbies.forEach(lobby => {
            //We only want to send lobbies waiting for players
            if(!lobby.inGame) jsonLobbies.push(lobby.toJson())
        });
        let jsonPacket = {
            packetID: Packet.LobbyList,
            data: {
                lobbies: jsonLobbies
            }
        }
        con.send(JSON.stringify(jsonPacket))
    }

    function sendLobby(lobby: Lobby, con: connection) {
        let jsonPacket = {
            packetID: Packet.Lobby,
            data: lobby.toJson()
        }
        con.send(JSON.stringify(jsonPacket))
    }

    function checkPlayer(player: Player) : Boolean {
        if (player == undefined) {
            console.log("Error: Undefined Player!")
            return false
        } 
        return true
    }

    function leaveLobby(player: Player) {
        const lobby = player.lobby
        if(isNullOrUndefined(lobby) || lobby.id == 0) return
        lobby.RemovePlayer(player)      //Remove this player
        if(lobby.playerCount == 0) {    //Remove this lobby if no players remain
            const index = lobbies.indexOf(lobby, 0)
            if(index > -1) lobbies.splice(index, 1)
            for (const p of players) {          //Update all players looking that this lobby has closed
                if(p.lobby.id == 0) sendLobbyList(p.connection) 
            }
        } else {        //Update all players in lobby of change
            let jsonPacket = {
                packetID : Packet.Message,
                data: {
                    author: "Server",
                    message: player.name+" has left the lobby"
                }
            }
            for (const p of lobby.players) {    
                sendLobby(lobby, p.connection)
                p.connection.send(JSON.stringify(jsonPacket))
            }
        }
        
    }


    connection.on('message', function(message) {
        console.log(message)

        //Get the raw packet
        let json = JSON.parse(message.utf8Data)

        //Use the ID to correctly detirmine what packet came in
        switch(json.data.packetID) {
            case Packet.Login : {
                let name = json.data.name
                players.push(new Player(name, connection))
                sendLobbyList(connection)
                break
            }
            case Packet.JoinLobby : {
                let lobbyID = json.data.lobbyID
                const lobby = lobbies.find(lobby => lobby.id === lobbyID)
                const player = players.find(player => player.connection == connection)
                if (!checkPlayer(player)) break 
                if(lobby == undefined || player == undefined){
                    console.log("Error Joining Lobby!")
                    break
                }
                console.log(player.name + ' has requested to join Lobby: ' + lobbyID + ': ' + lobby.name)
                lobby.AddPlayer(player)
                lobby.players.forEach(player => {
                    sendLobby(lobby, player.connection) //Update all players in lobby
                });
                let jsonPacket = {
                    packetID: Packet.Message,
                    data: {
                        author: lobby.chat[0].author,
                        message: lobby.chat[0].message
                    }
                }
                connection.send(JSON.stringify(jsonPacket))
                break
            }
            case Packet.NewLobby : {
                const player = players.find(player => player.connection == connection)
                if (!checkPlayer(player)) break     
                let newLobby = new Lobby(json.data.name, json.data.maxPlayers)
                lobbies.push(newLobby)
                newLobby.AddPlayer(player)
                sendLobby(newLobby, connection)     //Send the creator directly to their lobby
                for( const p of players) {          //Update other users of new lobby
                    if(p.lobby.id == 0) sendLobbyList(p.connection)
                }
                let jsonPacket = {
                    packetID: Packet.Message,
                    data: {
                        author: newLobby.chat[0].author,
                        message: newLobby.chat[0].message
                    }
                }
                connection.send(JSON.stringify(jsonPacket))
                break
            }
            case Packet.LeaveLobby : {
                const player = players.find(player => player.connection == connection)
                if (!checkPlayer(player)) break 
                leaveLobby(player)
                break
            }
            case Packet.Message : {
                const player = players.find(player => player.connection == connection)
                if (!checkPlayer(player)) break 
                const newMessage = new Message(json.data.author, json.data.message)
                player.lobby.chat.push(newMessage)
                let jsonPacket = {
                    packetID: Packet.Message,
                    data: {
                        author: newMessage.author,
                        message: newMessage.message
                    }
                }
                for ( const p of player.lobby.players) {    //Send message to all players in lobby
                    
                    p.connection.send(JSON.stringify(jsonPacket))
                }
                break
            }
            case Packet.Ready : {
                const player = players.find(player => player.connection == connection)
                if (!checkPlayer(player)) break 
                player.ready = json.data.ready
                if(player.lobby != null) {
                    for ( const p of player.lobby.players) {    //Update all users in lobby of change
                        sendLobby(p.lobby, p.connection)
                    }
                }
                break
            }
            case Packet.StartGame : {
                const player = players.find(player => player.connection == connection)
                if (!checkPlayer(player)) break 
                const lobby = player.lobby
                lobby.inGame = true
                let jsonPacket = {
                    packetID : Packet.StartGame,
                    data : {
                        inGame : lobby.inGame
                        //TODO: attach game object
                    }
                }
                for( const p of lobby.players) {
                    p.connection.send(JSON.stringify(jsonPacket))
                }
                break
            }
            case Packet.QuitGame : {
                const player = players.find(player => player.connection == connection)
                if (!checkPlayer(player)) break
                const lobby = player.lobby
                lobby.inGame = false
                let jsonPacket = {
                    packetID : Packet.QuitGame,
                    data : {
                        inGame : lobby.inGame
                    }
                }
                for( const p of lobby.players) {        //Notify all users of quit game
                    p.connection.send(JSON.stringify(jsonPacket))
                }
                const index = lobbies.indexOf(lobby, 0) //Kill the lobby
                if(index > -1) lobbies.splice(index, 1)
                for( const p of lobby.players) {        //Send lobby list update
                    sendLobbyList(p.connection)
                }
            }
            default : {
                console.log("Unknown Packet Received")
            }
        }

    });

    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        const player = players.find(player => player.connection == connection)
        if (!checkPlayer(player)) return
        leaveLobby(player)
    });
    
});