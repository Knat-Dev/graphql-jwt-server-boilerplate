/* eslint-disable no-control-regex */
import { DocumentType, mongoose } from "@typegoose/typegoose";
import { compare, hash } from "bcryptjs";
import { verify } from "jsonwebtoken";
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
import { FieldError } from "../../types";

@ObjectType()
class LoginResponse {
	@Field({ nullable: true })
	accessToken?: string;

	@Field(() => User, { nullable: true })
	user?: User;

	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];
}

@ObjectType()
class RegisterResponse {
	@Field({ nullable: true })
	ok?: boolean;

	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];
}

const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
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

	@Mutation(() => RegisterResponse)
	async register(
		@Arg("email") email: string,
		@Arg("username") username: string,
		@Arg("password") password: string
	): Promise<RegisterResponse> {
		const errors: FieldError[] = [];
		const trimmedEmail = email.trim();
		const trimmedUsername = username.trim();
		const trimmedUsernameLowerCase = trimmedUsername.toLocaleLowerCase();

		if (!trimmedEmail)
			errors.push({
				field: "email",
				message: "Email is required",
			});
		else if (!emailRegex.test(trimmedEmail))
			errors.push({
				field: "email",
				message: "Email is Invalid",
			});

		if (!trimmedUsername)
			errors.push({
				field: "username",
				message: "Username is required",
			});
		else if (trimmedUsername.length < 3)
			errors.push({
				field: "username",
				message: "Username length must be greater 3",
			});

		if (!password.trim())
			errors.push({
				field: "password",
				message: "Password is required",
			});

		if (errors.length > 0) return { errors };

		const user = await UserModel.findOne({
			$or: [{ email: trimmedEmail }, { _username: trimmedUsernameLowerCase }],
		});

		if (user) {
			if (user.email === trimmedEmail)
				errors.push({
					field: "email",
					message: "Email is already is linked to an account",
				});
			else
				errors.push({
					field: "username",
					message: "Username is already is linked to an account",
				});
			return { errors };
		}
		try {
			const hashedPassword = await hash(password, 10);
			await UserModel.create({
				email: trimmedEmail,
				username: trimmedUsername,
				_username: trimmedUsernameLowerCase,
				password: hashedPassword,
			});

			return { ok: true };
		} catch (e) {
			console.error(e);
			return { ok: false };
		}
	}

	@Mutation(() => LoginResponse)
	async login(
		@Arg("email") email: string,
		@Arg("password") password: string,
		@Ctx() { res }: Context
	): Promise<LoginResponse> {
		const errors: FieldError[] = [];
		const trimmedEmail = email.trim();

		if (!trimmedEmail)
			errors.push({ field: "email", message: "Email is required" });

		if (errors.length > 0) return { errors };

		const user = await UserModel.findOne({
			$or: [
				{ email: trimmedEmail },
				{ _username: trimmedEmail.toLocaleLowerCase() },
			],
		});

		if (!user)
			errors.push({
				field: "email",
				message: "Email/Username could not be found",
			});

		if (!user || errors.length > 0)
			return {
				errors,
			};

		const valid = await compare(password, user.password);

		if (!valid) {
			errors.push({
				field: "password",
				message: "Password is wrong",
			});
			return { errors };
		}

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
