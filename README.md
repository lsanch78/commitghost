# commitghost

AI-powered commit message suggestions from your staged diff, right in the terminal. I made this for myself because I was consistently forgetting to commit often enough and English is hard sometimes.

```
$ git add -A
$ commitghost

┌  commitghost
◇  Read diff across 3 file(s)
◇  Got candidates
●  Pick a commit message
   feat: add config wizard for interactive setup
   feat(config): add --config flag with interactive TUI
   ✎  Edit a candidate
   ↻  Regenerate
   ✕  Cancel
```

## Install

```sh
npm install -g commitghost
```

This gives you two equivalent commands: `commitghost` and the shorter `commitg`.

## Setup

Run the config wizard and paste in your API key when prompted:

```sh
commitghost --config
```

The key is saved to `~/.commitghost/credentials` (created with `chmod 600`, readable only by you) and picked up automatically on future runs — no shell profile editing required.

Prefer an environment variable instead? That still works and takes priority over the stored key:

```sh
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
```

## Usage

```sh
git add -A
commitghost                 # generate candidates, pick one, commit
commitghost --dry-run        # preview without committing
commitghost -p openai        # use OpenAI instead of Anthropic
commitghost -n 5              # generate 5 candidates instead of 3
commitghost --config          # open the interactive config wizard
```

## Config

Run `commitghost --config` for an interactive setup wizard, or hand-write a `.commitghost.json` in your repo root:

```json
{
  "provider": "anthropic",
  "model": "claude-haiku-4-5-20251001",
  "style": "conventional commits, no body",
  "candidateCount": 3,
  "warnLines": 150
}
```

| Field | Description |
|---|---|
| `provider` | `anthropic` or `openai` |
| `model` | Override the default model for the chosen provider |
| `style` | Force a specific commit style; omit to auto-match your repo's recent commit history |
| `candidateCount` | Number of candidates to generate (1–10) |
| `warnLines` | Line-change threshold for the shell prompt ghost (see below) |

## The ghost

commitghost can drop a little `(o_o)` into your shell prompt when your working tree diff grows past a threshold — a nudge to commit before things get out of hand.

Add to `~/.zshrc`:

```sh
eval "$(commitghost shell-init zsh)"
PROMPT='%~ $(commitghost_prompt)%# '
```

or `~/.bashrc`:

```sh
eval "$(commitghost shell-init bash)"
PS1='\w $(commitghost_prompt)\$ '
```

The ghost appears once your staged + unstaged diff exceeds `warnLines` (default 150), and disappears once you commit.

## Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required when using the `anthropic` provider |
| `OPENAI_API_KEY` | Required when using the `openai` provider |
| `COMMITGHOST_PROVIDER` | Default provider if not set in config |
| `COMMITGHOST_WARN_LINES` | Default ghost threshold if not set in config |

## License

MIT
