export const ZSH_INIT = `
_commitghost_last=""

_commitghost_precmd() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    _commitghost_last="$(commitghost ghost-check 2>/dev/null)"
  else
    _commitghost_last=""
  fi
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd _commitghost_precmd

commitghost_prompt() {
  echo -n "$_commitghost_last"
}

# Add commitghost_prompt to your PROMPT, e.g.:
#   PROMPT='%~ $(commitghost_prompt)%# '
`;

export const BASH_INIT = `
_commitghost_last=""

_commitghost_precmd() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    _commitghost_last="$(commitghost ghost-check 2>/dev/null)"
  else
    _commitghost_last=""
  fi
}

PROMPT_COMMAND="_commitghost_precmd\${PROMPT_COMMAND:+; \$PROMPT_COMMAND}"

commitghost_prompt() {
  echo -n "$_commitghost_last"
}

# Add commitghost_prompt to your PS1, e.g.:
#   PS1='\\w $(commitghost_prompt)\\$ '
`;
