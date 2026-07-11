export const ZSH_INIT = `
_commitghost_precmd() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local ghost
    ghost="$(commitghost ghost-check 2>/dev/null)"
    if [ -n "$ghost" ]; then
      print -P "%{$'\\e[36m'%}$ghost large diff — consider committing%{$'\\e[0m'%}"
    fi
  fi
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd _commitghost_precmd
`;

export const BASH_INIT = `
_commitghost_precmd() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local ghost
    ghost="$(commitghost ghost-check 2>/dev/null)"
    if [ -n "$ghost" ]; then
      echo -e "\\e[36m$ghost large diff — consider committing\\e[0m"
    fi
  fi
}

PROMPT_COMMAND="_commitghost_precmd\${PROMPT_COMMAND:+; \$PROMPT_COMMAND}"
`;
