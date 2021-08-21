import { NextFunction, Request, Response } from "express"
import { validationResult, oneOf, check } from "express-validator"

import { BoardDocument, IBoardMember } from "../models/Board"
import {
  RequestValidationError,
  PermissionRequestError,
  errorService,
  permissionManager,
  IPermissionType,
  NotFoundError,
  BadRequestError,
} from "@tusksui/shared"
import { boardService } from "../services/board"
import { allowedBoardUpdateFields } from "../utils/constants"
import { isValidObjectId } from "mongoose"

const { catchAsyncError } = errorService

declare global {
  namespace Express {
    interface Request {
      board: BoardDocument | null | undefined
    }
  }
}

class BoardMiddleware {
  verifyAccessPermission(requirePermissionFlag: IPermissionType) {
    return catchAsyncError(
      async (req: Request, _res: Response, next: NextFunction) => {
        const _id = req.params.boardId

        if (!isValidObjectId(_id))
          throw new BadRequestError("Board id is required")

        const userId = req.currentUserJwt.userId!

        const board = await boardService.findBoardOnlyById(_id)

        if (!board) throw new NotFoundError("Board with that id was not found")

        const existingBoardMember = board.members.find(
          (member: IBoardMember) => member.id === userId
        )

        if (!existingBoardMember) {
          throw new PermissionRequestError()
        }

        const isGrantedPermission = permissionManager.checkIsPermitted(
          existingBoardMember.permissionFlag,
          requirePermissionFlag
        )

        if (!isGrantedPermission) {
          throw new PermissionRequestError()
        }

        req.board = board
        next()
      }
    )
  }

  checkRequiredBodyFields = [
    oneOf(
      allowedBoardUpdateFields.map((field: string) =>
        check(field).exists().trim().withMessage(`${field} is required.`)
      )
    ),
  ]

  validateRequestBodyFields = catchAsyncError(
    async (req: Request, _res: Response, next: NextFunction) => {
      const errors = validationResult(req)

      if (!errors.isEmpty()) {
        throw new RequestValidationError(errors.array())
      }

      next()
    }
  )
}

export const boardMiddleware = new BoardMiddleware()
