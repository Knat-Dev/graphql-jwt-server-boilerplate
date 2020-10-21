import dotenv from "dotenv";
dotenv.config();
import "reflect-metadata";
import mongoose, { ConnectionOptions } from "mongoose";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { UserResolver } from "./graphql";
import { buildSchema } from "type-graphql";
import cookieParser from "cookie-parser";
import cors from "cors";
import { refresh } from "./util";

// PORT
const port = process.env.PORT || 8080;

// Mongoose Connection Options
const mongooseConnectionOptions: ConnectionOptions = {
	useFindAndModify: false,
	useNewUrlParser: true,
	useUnifiedTopology: true,
};

(async () => {
	// Express App
	const app = express();
	// Express Middleware
	app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
	app.use(cookieParser());
	// Express Routes
	app.post("/refresh", refresh);
	// Creating MongoDB Connection
	await mongoose.connect(
		"mongodb://127.0.0.1:27017/test-db-jwt",
		mongooseConnectionOptions
	);
	console.log("MongoDB connection started.");
	// Setting up Apollo Server to work with the schema
	const apollo = new ApolloServer({
		schema: await buildSchema({ resolvers: [UserResolver] }),
		context: ({ req, res }) => ({ req, res }),
		playground: {
			settings: {
				"request.credentials": "include",
			},
		},
	});
	apollo.applyMiddleware({ app, path: "/api", cors: false });
	// Starting up Express Server
	app.listen(port, () => {
		console.log(`GraphQL playground running at http://localhost:${port}/api`);
	});
})();
