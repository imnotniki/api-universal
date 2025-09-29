#!/usr/bin/env bash

ENV_FILE=".env"

NEW_KEY=$(openssl rand -hex 20)
AUTH_KEY_LINE="API_AUTH_TOKEN=$NEW_KEY"

if grep -q "^API_AUTH_TOKEN=" "$ENV_FILE"; then
    sed "s|^API_AUTH_TOKEN=.*|$AUTH_KEY_LINE|" "$ENV_FILE" > "${ENV_FILE}.tmp"
    mv "${ENV_FILE}.tmp" "$ENV_FILE"
    echo "Updated existing API_AUTH_TOKEN in $ENV_FILE"
else
    echo "$AUTH_KEY_LINE" >> "$ENV_FILE"
    echo "Added new API_AUTH_TOKEN to $ENV_FILE"
fi