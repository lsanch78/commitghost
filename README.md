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

This gives you three equivalent commands: `commitghost`, the shorter `commitg`, and `git commitg` (git resolves any `git commitg` invocation to the `git-commitg` executable on your `PATH`, the same mechanism behind tools like `hub`).

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
git commitg                 # same thing, as a git subcommand
commitghost --dry-run        # preview without committing
commitghost -p openai        # use OpenAI instead of Anthropic
commitghost -p ollama        # use a local Ollama model instead
commitghost -n 5              # generate 5 candidates instead of 3
commitghost -v                 # show file stats, token usage, cost, and timing
commitghost --config          # open the interactive config wizard
```

### Using Ollama

No API key required — commitghost talks to a local [Ollama](https://ollama.com) server:

```sh
ollama serve                      # if not already running
ollama pull llama3.1              # or any other model you want to use
commitghost -p ollama
```

By default it connects to `http://localhost:11434`. Point it elsewhere with `OLLAMA_HOST`:

```sh
export OLLAMA_HOST=http://192.168.1.50:11434
```

## Config

Run `commitghost --config` for an interactive setup wizard, or hand-write a `.commitghost.json` in your repo root:

```json
{
  "provider": "anthropic",
  "model": "claude-haiku-4-5-20251001",
  "style": "conventional commits, no body",
  "candidateCount": 3,
  "warnLines": 150,
  "verbose": false
}
```

| Field            | Description                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `provider`       | `anthropic`, `openai`, or `ollama`                                                                                                     |
| `model`          | Override the default model for the chosen provider                                                                                     |
| `style`          | Force a specific commit style; omit to auto-match your repo's recent commit history                                                    |
| `candidateCount` | Number of candidates to generate (1–10)                                                                                                |
| `warnLines`      | Line-change threshold for the shell prompt ghost (see below)                                                                           |
| `verbose`        | Always show file stats, token usage, cost, and timing (same as passing `-v` every time). Override per-run with `-v` or `--no-verbose`. |

## The ghost

commitghost can print a little 👻 above your prompt when your working tree diff grows past a threshold — a nudge to commit before things get out of hand.

Set it up in one step:

```sh
commitghost install-ghost
```

This auto-detects your shell and appends a hook to `~/.zshrc` or `~/.bashrc`. Restart your terminal (or `source` the file) and you're done — no manual editing of `PROMPT`/`PS1` required, and it won't break existing prompt themes since the ghost prints on its own line rather than being spliced into your prompt string. Safe to run more than once; it won't install itself twice.

Prefer to wire it in by hand (e.g. to control exactly where it prints)? Run `commitghost shell-init zsh` (or `bash`) to print the raw snippet and paste it into your rc file yourself.

The ghost appears once your staged + unstaged diff exceeds `warnLines` (default 150), and disappears once you commit.

To remove it:

```sh
commitghost uninstall-ghost
```

## Environment variables

| Variable                 | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `ANTHROPIC_API_KEY`      | Required when using the `anthropic` provider         |
| `OPENAI_API_KEY`         | Required when using the `openai` provider            |
| `OLLAMA_HOST`            | Ollama server URL (default `http://localhost:11434`) |
| `COMMITGHOST_PROVIDER`   | Default provider if not set in config                |
| `COMMITGHOST_WARN_LINES` | Default ghost threshold if not set in config         |

## License

MIT
