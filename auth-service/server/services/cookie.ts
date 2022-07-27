import jwt from "jsonwebtoken"
import {
  BadRequestError,
  IJwtAccessTokens,
  IJwtAuthToken,
} from "@tusksui/shared"
import { IAuthTokenOptions } from "../types"
import { IUserDocument, User } from "../models/User"
import { Request } from "express"
import { AuthService } from "./auth"
import { Token } from "../models/Token"

export class CookieService {
  static generateCookies = (req: Request, tokens: IJwtAccessTokens) => {
    req.session = null

    return (req.session = {
      jwt: tokens,
    })
  }

  static generateAccessToken(
    tokenToSign: IJwtAuthToken,
    expiresIn: string,
    currentAccessToken?: string
  ) {
    const isValidToken =
      currentAccessToken &&
      CookieService.isTokenValid(
        currentAccessToken,
        process.env.JWT_TOKEN_SIGNATURE!
      )

    if (isValidToken) {
      return currentAccessToken!
    }

    const token = jwt.sign(tokenToSign, process.env.JWT_TOKEN_SIGNATURE!, {
      expiresIn,
    })

    return token
  }

  static async generateRefreshToken(
    tokenToSign: IJwtAuthToken,
    expiresIn: string
  ) {
    let existingToken = await CookieService.findRefreshTokenByUserId(
      tokenToSign.userId!
    )

    if (existingToken) {
      const tokenIsValid = CookieService.isTokenValid(
        existingToken.token!,
        process.env.JWT_REFRESH_TOKEN_SIGNATURE!
      )

      if (tokenIsValid) return existingToken.token
    }

    const token = jwt.sign(
      tokenToSign,
      process.env.JWT_REFRESH_TOKEN_SIGNATURE!,
      {
        expiresIn,
      }
    )

    const refreshToken = new Token({
      userId: tokenToSign.userId,
      token,
      tokenType: "refresh",
    })

    await refreshToken.save()

    return refreshToken?.token
  }

  static isTokenValid(token?: string, signature?: string) {
    try {
      if (!token) throw new BadRequestError("token is required")
      if (jwt.verify(token, signature!)) return true
    } catch (error) {
      return false
    }
  }

  static async invalidateRefreshToken(user: IUserDocument) {
    const refreshToken = await Token.findOne({
      userId: user.id,
      valid: true,
      tokenType: "refresh",
    })

    if (refreshToken) {
      refreshToken.valid = false
      refreshToken?.save()
    }
  }

  static getAuthTokens = async (
    tokenToSign: IJwtAuthToken,
    options?: IAuthTokenOptions
  ) => {
    let accessTokenExpiresIn: string
    let refreshTokenExpiresIn: string

    if (options?.isRefreshingToken) {
      accessTokenExpiresIn = options?.accessExpiresAt || "2d"
      refreshTokenExpiresIn = options?.refreshExpiresAt || "7d"
    } else {
      accessTokenExpiresIn = options?.accessExpiresAt || "10h"
      refreshTokenExpiresIn = options?.refreshExpiresAt || "1d"
    }

    const accessToken = CookieService.generateAccessToken(
      tokenToSign,
      accessTokenExpiresIn,
      options?.accessToken
    )

    const refreshToken = await CookieService.generateRefreshToken(
      tokenToSign,
      refreshTokenExpiresIn
    )

    const tokens: IJwtAccessTokens = {
      access: accessToken,
      refresh: refreshToken,
    }

    return tokens
  }

  static findUserByJwt = async (decodedJWT: IJwtAuthToken) => {
    const user = await User.findOne({
      email: decodedJWT.email,
      _id: decodedJWT.userId,
    })

    return user
  }

  static async findRefreshTokenOnlyById(refreshTokenId: string) {
    const token = await Token.findById(refreshTokenId, { type: "refresh" })
    return token
  }

  static async findRefreshTokenByUserId(userId: string) {
    const token = await Token.findOne({
      userId,
      tokenType: "refresh",
      valid: true,
    })
    return token
  }

  static findUserByRefreshJwt = async (userId: string) => {
    const token = await Token.findOne({
      tokenType: "refresh",
      userId,
      valid: true,
    })

    if (!token) {
      throw new BadRequestError("Token may have expired.")
    }
    const user = await AuthService.findUserOnlyById(token.userId)

    return user
  }
}
