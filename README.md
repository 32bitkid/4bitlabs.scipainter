# @4bitlabs/scipainter

[![License][license]][npm]
[![NPM Version][version]][npm]
[![Ko-fi][kofibadge]][kofi]

![Space Quest 3 Demo PIC.002](https://raw.githubusercontent.com/32bitkid/4bitlabs.scipainter/main/assets//r.sq3demo.002.webp)

[npm]: https://www.npmjs.com/package/@4bitlabs/scipainter
[version]: https://img.shields.io/npm/v/%404bitlabs%2Fscipainter
[license]: https://img.shields.io/npm/l/%404bitlabs%2Fscipainter
[dl]: https://img.shields.io/npm/dy/%404bitlabs%2Fscipainter
[kofibadge]: https://shields.io/badge/ko--fi-donate-ff5f5f?logo=ko-fi&style=for-the-badgeKo-fi
[kofi]: https://ko-fi.com/thirtytwo

## Usage

```
npx @4bitlabs/scipainter
```

## Commands

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

## Rendering a PIC 

```text
Usage: scipainter render [options] <pic>

Arguments:
  pic                         PIC resource number

Options:
  -o, --output <file>         output filename. use '-' to output to STDOUT
  -f, --format <format>       (choices: "jpeg", "webp", "png", default: "png")
  --show-seed                 output the seed to STDERR
  -s, --seed <seed>           seed to use for pRNG in base36. default: random
                              number
  --background-color <color>  background color (default: "white")
  --paper <path>              path to optional paper texture
  -h, --help                  display help for command
```

For example, let's say you have an archive of the Space Quest 3 Demo, which can be found
freely online in several archives, in a folder `./sq3demo`. You can render `PIC.002` from with:

```bash
npx @4bitlabs/scipainter --root ./sq3demo render 2 
```

> [!note]
> _But, how do you know what PIC id to use?_ You can use `@4bitlabs/scibud` to help
> identify what PIC resources are available for a given game. See the
> [GitHub documentation](https://github.com/32bitkid/sci.js/tree/main/apps/scibud)
> for more details.

This will create a image named `render.png`. You can change the format by using the `--format` option.

```bash
npx @4bitlabs/scipainter -r ./sq3demo render 2 --format jpeg
```

And also set the output file:

```bash
npx @4bitlabs/scipainter -r ./sq3demo render 2 -f webp --output sq3demo.002.webp
```

## Randomness and seeds

Every render will, by default, select a random seed for the pRNG, this results in reach rendering 
being unique. Using the same seed should produce the same visual result. Use the `--seed` option to
manually set the seed, for reproducible images. When rendering, you can use `--show-seed` to output 
the current seed, even if its random, so it can be reused later.

```bash
$ npx @4bitlabs/scipainter -r /path/to/sci/game render 1 --show-seed
seed: tg609d

$ npx @4bitlabs/scipainter -r /path/to/sci/game render 1 --seed tg609d
```

> [!warning]
> At this time, stable image regeneration—from the same seed—is _not_ guaranteed between 
> different versions of this program. So, renderings with `1.1.0` may produce different results
> than `1.5.0`, even using the same `seed`. This is a short-coming I may address in the future.

## More Examples 

<figure>
    <img src="https://raw.githubusercontent.com/32bitkid/4bitlabs.scipainter/main/assets//r.qg1demo.064.webp" alt="Quest for Glory 1 Demo PIC.064">
    <figcaption>Quest for Glory 1 Demo <code>PIC.064</code></figcaption>
</figure>

<figure>
    <img src="https://raw.githubusercontent.com/32bitkid/4bitlabs.scipainter/main/assets//r.cocdemo.012.webp" alt="Conquests of Camelot Demo Demo PIC.012">
    <figcaption>Conquests of Camelot Demo <code>PIC.012</code></figcaption>
</figure>

## Related Projects

- Sierra SCI0/SCI01 parsing: https://github.com/32bitkid/sci.js
- Procgen watercolor effect: https://github.com/32bitkid/watercolorizer
