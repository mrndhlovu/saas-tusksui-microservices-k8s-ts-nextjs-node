import { BadRequestError } from "@tuskui/shared"

import services from "./services"
import { app } from "./app"
import { natsService } from "./services/nats"
import {
  BoardByIdListener,
  BoardCreatedListener,
  BoardDeletedListener,
  BoardListListener,
} from "./events/listeners"
import { BoardByIdPublisher } from "./events/publishers/board-get"
class Server {
  private validateEnvVariables() {
    const {
      PORT,
      JWT_TOKEN_SIGNATURE,
      JWT_REFRESH_TOKEN_SIGNATURE,
      AUTH_MONGO_URI,
      NATS_URL,
      NATS_CLIENT_ID,
      NATS_CLUSTER_ID,
    } = process.env

    if (
      !PORT ||
      !JWT_TOKEN_SIGNATURE ||
      !JWT_REFRESH_TOKEN_SIGNATURE ||
      !AUTH_MONGO_URI ||
      !NATS_CLUSTER_ID ||
      !NATS_CLIENT_ID ||
      !NATS_URL
    ) {
      throw new BadRequestError("Some Env variables are missing!")
    }
  }

  async start() {
    this.validateEnvVariables()

    const { NODE_ENV, PORT } = process.env

    const port = parseInt(PORT!, 10)

    await natsService.connect(
      process.env.NATS_CLUSTER_ID!,
      process.env.NATS_CLIENT_ID!,
      process.env.NATS_URL!
    )
    natsService.handleOnclose()

    new BoardCreatedListener(natsService.client).listen()
    new BoardDeletedListener(natsService.client).listen()
    new BoardByIdListener(natsService.client).listen()
    new BoardListListener(natsService.client).listen()

    await services.database.connect()
    app.listen(port, () => {
      const serverStatus = [
        {
          "Server Status": "Online",
          Environment: NODE_ENV!,
          Port: port,
        },
      ]
      console.table(serverStatus)
    })
  }
}

const server = new Server()

server.start()
