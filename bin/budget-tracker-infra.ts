#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BudgetTrackerStack } from "../lib/BudgetTrackerStack";
import * as dotenv from "dotenv";

dotenv.config();

const app = new cdk.App();
new BudgetTrackerStack(app, "BudgetTrackerStack", {
  env: {
    account: process.env.AWS_CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_CDK_DEFAULT_REGION,
  },
});
