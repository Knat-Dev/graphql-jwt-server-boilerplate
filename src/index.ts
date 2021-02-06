import { ApolloServer } from "apollo-server-express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose, { ConnectionOptions } from "mongoose";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { UserResolver } from "./graphql";
import { refresh } from "./util";
dotenv.config();

// PORT
const port = process.env.PORT || 5000;

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
	// Trust proxy for production
	app.set("trust proxy", 1);
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
