import mongoose from "mongoose"
import { Request, Response } from "express"

import { BadRequestError } from "@tuskui/shared"

import { allowedListUpdateFields } from "../utils/constants"
import { listService } from "../services/list"
import Board from "../models/Board"
import List, { ListDocument } from "../models/List"

declare global {
  namespace Express {
    interface Request {
      list: ListDocument | null | undefined
    }
  }
}

class ListController {
  getList = async (req: Request, res: Response) => {
    const { archived } = req.query
    const isTrue = archived === "true"

    let lists = await List.find({
      boardId: req.params.boardId,
      archived: isTrue,
    })

    res.send(lists)
  }

  getListById = async (req: Request, res: Response) => {
    const list = await listService.findListOnlyById(req.params.listId)

    if (!list) throw new BadRequestError("List with that id was not found")

    res.send(list)
  }

  createList = async (req: Request, res: Response) => {
    const boardId = req.params.boardId

    let list = new List({
      ...req.body,
      boardId,
    })

    const board = await Board.findOneAndUpdate(
      { _id: boardId },
      { $push: { lists: list._id } }
    )

    if (!board) throw new BadRequestError("Failed to create a list")

    await list.save()
    await board.save()

    res.status(201).send(list)
  }

  updateList = async (req: Request, res: Response) => {
    const updates = Object.keys(req.body)
    const list = await listService.findListById(req.params.listId)

    const hasValidFields = listService.validateEditableFields(
      allowedListUpdateFields,
      updates
    )

    if (!hasValidFields) throw new BadRequestError("Invalid update field")

    const updatedList = await List.findOneAndUpdate(
      { _id: list._id },
      { $set: { ...req.body } },
      { new: true }
    )

    await updatedList.save()

    res.status(200).send(updatedList)
  }

  deleteList = async (req: Request, res: Response) => {
    const { deleteAll } = req.query
    const shouldDeleteAll = deleteAll === "true"

    if (shouldDeleteAll) {
      const lists = await List.find({ boardId: req.params.boardId })
      const listIds = lists.map((list: ListDocument) => list._id.toHexString())

      await List.deleteMany({ _id: listIds })

      return res.status(200).send({})
    }
    const list = await listService.findListById(req.params.listId)

    await list.delete()

    res.status(200).send({})
  }
}

const listController = new ListController()

export { listController }