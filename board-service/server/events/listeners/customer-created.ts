import { Message } from "node-nats-streaming"

import {
  ICustomerCreated,
  Listener,
  queueGroupNames,
  Subjects,
} from "@tusksui/shared"

import Workspace from "../../models/Workspace"
import { WorkspaceCreatedPublisher } from "../publishers/workspace-created"
import { natsService } from "../../services"

export class CustomerCreatedListener extends Listener<ICustomerCreated> {
  readonly subject: Subjects.CustomerCreated = Subjects.CustomerCreated
  queueGroupName = queueGroupNames.BOARDS_QUEUE_GROUP

  onMessage = async (data: ICustomerCreated["data"], msg: Message) => {
    console.log("Event data ", data)

    try {
      const workspace = new Workspace({
        owner: data.userId,
        name: "Default",
        category: "default",
      })

      await workspace.save()

      await new WorkspaceCreatedPublisher(natsService.client).publish({
        ownerId: data.userId,
        id: workspace?._id.toString(),
      })

      msg.ack()
    } catch (error) {
      return error
    }
  }
}
