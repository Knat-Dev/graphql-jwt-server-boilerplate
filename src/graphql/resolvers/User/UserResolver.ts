import { DocumentType, mongoose } from "@typegoose/typegoose";
import { compare, hash } from "bcryptjs";
import { verify } from "jsonwebtoken";
import { Error } from "mongoose";
import {
	Arg,
	Ctx,
	Field,
	Mutation,
	ObjectType,
	Query,
	Resolver,
	UseMiddleware,
} from "type-graphql";
import { User, UserModel } from "../../../models";
import {
	createAccessToken,
	createRefreshToken,
	isAuthorized,
	sendRefreshToken,
} from "../../../util";
import { Context } from "../../context";

@ObjectType()
class LoginResponse {
	@Field()
	accessToken: string;

	@Field()
	user: User;
}

@Resolver(() => User)
export class UserResolver {
	@Query(() => String)
	@UseMiddleware(isAuthorized)
	hello(@Ctx() { payload }: Context): string {
		return `Your user id is: ${payload?.userId}`;
	}

	@Query(() => [User])
	async users(): Promise<DocumentType<User>[]> {
		return await UserModel.find();
	}

	@Query(() => User, { nullable: true })
	async me(@Ctx() context: Context): Promise<DocumentType<User> | null> {
		const { req } = context;
		const authorization = req.headers["authorization"];
		if (!authorization) return null;
		const token = authorization.split(" ")[1];

		let payload: any;
		try {
			payload = verify(token, `${process.env.JWT_ACCESS_TOKEN_SECRET}`);
			context.payload = payload as { userId: string };
		} catch (e) {
			console.error(e.message);
			return null;
		}
		return await UserModel.findById(
			mongoose.Types.ObjectId(`${context.payload.userId}`)
		);
	}

	@Mutation(() => Boolean)
	async register(
		@Arg("email") email: string,
		@Arg("password") password: string
	): Promise<boolean> {
		const user = await UserModel.findOne({ email });
		if (user) throw new Error("Email address already exists");
		try {
			const hashedPassword = await hash(password, 10);
			await UserModel.create({
				email,
				password: hashedPassword,
			});

			return true;
		} catch (e) {
			console.error(e);
			return false;
		}
	}

	@Mutation(() => LoginResponse)
	async login(
		@Arg("email") email: string,
		@Arg("password") password: string,
		@Ctx() { res }: Context
	): Promise<LoginResponse> {
		const user = await UserModel.findOne({ email });
		if (!user) throw new Error("Could not find user with given Email address");
		const valid = await compare(password, user.password);

		if (!valid) throw new Error("Bad password");

		sendRefreshToken(res, createRefreshToken(user));
		return {
			accessToken: createAccessToken(user),
			user,
		};
	}

	@Mutation(() => Boolean)
	async revokeRefreshTokenForUser(
		@Arg("userId") userId: string
	): Promise<boolean> {
		await UserModel.findOneAndUpdate(
			{ _id: userId },
			{ $inc: { tokenVersion: 1 } },
			{ new: true }
		);

		return true;
	}

	@Mutation(() => Boolean)
	async logout(@Ctx() { res }: Context): Promise<boolean> {
		sendRefreshToken(res, "");
		return true;
	}
}
