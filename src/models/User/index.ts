import { getModelForClass, prop } from "@typegoose/typegoose";
import { Field, ID, ObjectType } from "type-graphql";

@ObjectType()
export class User {
	@Field(() => ID)
	id: string;

	@Field()
	@prop({ required: true })
	public username!: string;

	@Field()
	@prop({ required: true })
	public _username!: string;

	@Field()
	@prop({ required: true })
	public email!: string;

	@prop({ required: true })
	public password!: string;

	@Field()
	@prop({ default: 0 })
	public tokenVersion?: number;
}

export const UserModel = getModelForClass(User);
