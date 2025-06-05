CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
