import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import { initGame, drawCard, addDrawnCardToHand, addDrawnCardToTarget, playCard, endTurn, startNextRound } from "./src/services/gameService.js";
import { GameState } from "./src/types/index.js";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  // Matchmaking and Game State
  let waitingPlayer: string | null = null;
  const games: Record<string, { state: GameState, players: string[] }> = {};
  const playerToGame: Record<string, string> = {};

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("findMatch", () => {
      if (waitingPlayer && waitingPlayer !== socket.id) {
        // Match found
        const roomId = `game_${waitingPlayer}_${socket.id}`;
        const p1 = waitingPlayer;
        const p2 = socket.id;
        
        waitingPlayer = null;

        const initialState = initGame();
        // Modify names for multiplayer
        initialState.players[0].name = "Player 1";
        initialState.players[1].name = "Player 2";
        initialState.mode = "multiplayer";

        games[roomId] = {
          state: initialState,
          players: [p1, p2]
        };

        playerToGame[p1] = roomId;
        playerToGame[p2] = roomId;

        const socket1 = io.sockets.sockets.get(p1);
        const socket2 = io.sockets.sockets.get(p2);

        if (socket1) {
          socket1.join(roomId);
          socket1.emit("matchFound", { roomId, playerIndex: 0, state: initialState });
        }
        if (socket2) {
          socket2.join(roomId);
          socket2.emit("matchFound", { roomId, playerIndex: 1, state: initialState });
        }
      } else {
        // Wait for match
        waitingPlayer = socket.id;
        socket.emit("waitingForMatch");
      }
    });

    socket.on("cancelMatch", () => {
      if (waitingPlayer === socket.id) {
        waitingPlayer = null;
      }
    });

    socket.on("action", (data) => {
      const roomId = playerToGame[socket.id];
      if (!roomId || !games[roomId]) return;

      const game = games[roomId];
      const playerIndex = game.players.indexOf(socket.id);

      try {
        let newState = game.state;
        switch (data.type) {
          case "drawCard":
            newState = drawCard(newState);
            break;
          case "addDrawnCardToHand":
            newState = addDrawnCardToHand(newState);
            break;
          case "addDrawnCardToTarget":
            newState = addDrawnCardToTarget(newState);
            break;
          case "playCard":
            newState = playCard(newState, data.cardId);
            break;
          case "endTurn":
            newState = endTurn(newState);
            break;
          case "startNextRound":
            newState = startNextRound(newState);
            break;
          case "restartGame":
            newState = initGame(newState.isStrategicMode);
            newState.players[0].name = "Player 1";
            newState.players[1].name = "Player 2";
            newState.mode = "multiplayer";
            break;
          case "toggleStrategicMode":
            newState = initGame(data.isStrategicMode);
            newState.players[0].name = "Player 1";
            newState.players[1].name = "Player 2";
            newState.mode = "multiplayer";
            break;
          case "endGame":
            newState = { ...newState, status: "gameOver" };
            break;
        }
        game.state = newState;
        io.to(roomId).emit("gameStateUpdate", newState);
      } catch (e) {
        console.error("Action error", e);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      if (waitingPlayer === socket.id) {
        waitingPlayer = null;
      }
      
      const roomId = playerToGame[socket.id];
      if (roomId && games[roomId]) {
        io.to(roomId).emit("opponentDisconnected");
        const p1 = games[roomId].players[0];
        const p2 = games[roomId].players[1];
        if (p1) delete playerToGame[p1];
        if (p2) delete playerToGame[p2];
        delete games[roomId];
      }
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
