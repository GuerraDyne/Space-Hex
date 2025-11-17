import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";

/**
 * Import your Room files
 */
import { MyRoom } from "./rooms/MyRoom";
import { HexGameRoom } from "./rooms/HexGameRoom";
import { AIGameRoom } from "./rooms/AIGameRoom";
import { adminRoutes } from "./admin/adminRoutes";

export default config({

    initializeGameServer: (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('my_room', MyRoom);
        
        // Define HexGame room with matchmaking
        gameServer.define('hex_game', HexGameRoom)
          .enableRealtimeListing() // Enable for matchmaking
          .filterBy(['gameStarted', 'gamePhase', 'isPublic']); // Filter by game state and public status
        
        // Define AI Game room (using AIGameRoom)
        gameServer.define('ai_game', AIGameRoom);

    },

    initializeExpress: (app) => {
        // Enable CORS for the frontend
        app.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });

        /**
         * Bind your custom express routes here:
         * Read more: https://expressjs.com/en/starter/basic-routing.html
         */
        app.get("/hello_world", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });
        
        // Add admin routes for movement pattern editing
        app.use("/admin", adminRoutes);

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/monitor", monitor());
    },


    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});
