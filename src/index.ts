#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  decompress,
  parseAllMappings,
  parseHeaderWithPayload,
  parsePic,
  ResourceMatchers,
  ResourceTypes,
} from '@4bitlabs/sci0';
import { Command, InvalidArgumentError, Option } from 'commander';
import { render } from './drawing/render.js';
import { ensureExists } from './utils/ensure-exists.js';

async function findAndParsePic(
  rootPath: string,
  picId: number,
  engine: 'sci0' | 'sci01',
) {
  const files = await readdir(rootPath);
  const matchFn = ResourceMatchers.match({
    number: picId,
    type: ResourceTypes.PIC_TYPE,
  });

  const resourceMapFn = files.find((s) => s.match(/^resource.map$/i));
  ensureExists(resourceMapFn, `RESOURCE.MAP not found`);

  if (resourceMapFn === undefined) throw new Error('RESOURCE.MAP not found');
  const mappingPath = join(rootPath, resourceMapFn);
  const mappings = parseAllMappings(await readFile(mappingPath));

  const match = mappings.find(matchFn);
  ensureExists(match, `Resource PIC:${picId} not found…`);

  const resourceFn = files.find((s) => {
    const ext = match.file.toString(10).padStart(3, '0');
    return s.match(new RegExp(`^resource.${ext}$`, 'i'));
  });
  ensureExists(resourceFn, `${resourceFn} not found…`);

  const resourcePath = join(rootPath, resourceFn);
  const [header, resourcePayload] = parseHeaderWithPayload(
    await readFile(resourcePath),
    match.offset,
  );
  const payload = decompress(engine, header.compression, resourcePayload);
  return parsePic(payload, { defer: true });
}

const program = new Command();

program
  .name('scipainter')
  .description('Render SCI0/SCI01 pic images in a stylized, artistic style')
  .version(__APP_VERSION__)
  .option('-r, --root <path>', 'sci0/sci01 path', '.')
  .addOption(
    new Option('-e, --engine <engine>', 'SCI engine version')
      .choices(['sci0', 'sci01'])
      .default('sci0'),
  );

program
  .command('render')
  .argument('<pic>', 'PIC resource number', (source) => Number.parseInt(source))
  .addOption(
    new Option(
      '-o, --output <file>',
      `output filename. use '-' to output to STDOUT`,
    ),
  )
  .addOption(
    new Option('-f, --format <format>')
      .choices(['jpeg', 'webp', 'png'])
      .default('png'),
  )
  .addOption(new Option('--show-seed', 'output the seed to STDERR'))
  .addOption(
    new Option(
      '-s, --seed <seed>',
      'seed to use for pRNG in base36. default: random number',
    ).argParser((value) => {
      const seed = Number.parseInt(value, 36);
      if (Number.isNaN(seed))
        throw new InvalidArgumentError('seed must be numeric');
      return seed;
    }),
  )
  .addOption(
    new Option('--background-color <color>', 'background color').default(
      'white',
    ),
  )
  .addOption(new Option('--paper <path>', 'path to optional paper texture'))
  .action(
    async (
      picId: number,
      actionOptions: {
        output: string;
        format: 'png' | 'jpeg' | 'webp';
        seed: number | undefined;
        showSeed: boolean;
        paper: string | undefined;
        backgroundColor: string;
      },
    ) => {
      const rootPath = program.getOptionValue('root') as string;
      const engine = program.getOptionValue('engine') as 'sci0' | 'sci01';
      const format = actionOptions.format;

      const pic = await findAndParsePic(rootPath, picId, engine);
      const [canvas, seed] = await render(pic, actionOptions);

      if (actionOptions.showSeed) console.error(`seed: ${seed.toString(36)}`);

      const outFilename = actionOptions.output ?? `render.${format}`;
      const outfile =
        outFilename === '-' ? process.stdout : createWriteStream(outFilename);

      switch (format) {
        case 'jpeg':
        case 'webp': {
          outfile.write(await canvas.encode(format, 75));
          break;
        }
        default:
          outfile.write(await canvas.encode('png'));
          break;
      }

      outfile.end();
    },
  );

program.parse(process.argv);
