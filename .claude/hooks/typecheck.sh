#!/usr/bin/env bash
# Depois de editar um .ts em marte/src, roda o typecheck e devolve os erros ao Claude (não bloqueia).
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
case "$f" in */marte/src/*.ts) ;; *) exit 0 ;; esac
root="$(cd "$(dirname "$0")/../.." && pwd)"
out=$(cd "$root/marte" && timeout 60 npx tsc --noEmit 2>&1 | head -20)
if [ -n "$out" ]; then
  jq -n --arg e "$out" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:("Erros de TypeScript após a edição:\n"+$e)}}'
fi
exit 0
