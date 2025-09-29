#!/usr/bin/env bash

echo "Installing npm packages..."
sh ./scripts/npm.sh > /dev/null

echo "Copying .env file..."
echo "Generating API_AUTH_KEY..."
sh ./scripts/generateAuthKey.sh > /dev/null