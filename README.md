# @4bitlabs/scipainter

## Usage

```text 
Usage: scipainter [options] [command]

Render SCI0/SCI01 pic images in a stylized, artistic style

Options:
  -V, --version           output the version number
  -r, --root <path>       sci0/sci01 path (default: ".")
  -e, --engine <engine>   SCI engine version (choices: "sci0", "sci01", default:
                          "sci0")
  -h, --help              display help for command

Commands:
  render [options] <pic>
  help [command]          display help for command
```

## Rendering a single background

```text
Usage: scipainter render [options] <pic>

Arguments:
  pic                    PIC resource number

Options:
  -s, --seed <seed>      seed to use for pRNG. default: random number
  --show-seed            output the seed to STDERR.
  -f, --format <format>  (choices: "jpeg", "webp", "png", default: "png")
  -o, --output <file>    output filename. use '-' to output to STDOUT
  -h, --help             display help for command
```

Example render, writes to a file named in the current path `render.png` with the output.

```bash
npx @4bitlabs/scipainter -r /path/to/sci/game render 11 
```

> [!note]
> How do you know what PIC id to use? You can use `@4bitlabs/scibud` to help 
> identify what PIC resources are available, and what they look like. See the 
> [GitHub documentation](https://github.com/32bitkid/sci.js/tree/main/apps/scibud)
> for more details.

## Randomness

Every execution of will select a random seed, which will change each rendering to be unique.
To `--seed`