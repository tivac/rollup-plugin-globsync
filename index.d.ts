import rollup from 'rollup'

interface GlobSyncOptions {

  /**
   * Array of glob patterns to use for finding files to copy.
   */
  readonly globs:  string | ReadonlyArray<string>

  /**
   * Array of glob patterns to use for finding files to copy.
   *
   * @deprecated use `globs`
   */
  readonly patterns?:  string | ReadonlyArray<string>

  /**
   * Directory to copy files into.
   *
   * @default './dist'
   */
  readonly dest: string

  /**
   * Define the base dir to watch from.
   *
   * @default process.cwd()
   */
  readonly dir?: string

  /**
   * Whether or not to remove all files within `dist` when rollup starts up.
   *
   * @default true
   */
  readonly clean?: string

  /**
   * A function that allows for programatically changing the
   * destination of files.
   *
   * @default false
   */
  readonly transform?: (file: string) => string;


   /**
   * A string defining a package name for the manifest of files to be
   * copied/watched that you can import in your code.
   *
   * @default false
   */
  readonly manifest?: string |  boolean

  /**
   * A shorthand to enable verbose logging. Overrides `loglevel` option if set
   *
   * @default false
   */
  readonly verbose?: string | boolean

  /**
   * Specify the exact level to log at
   *
   * @default 'info'
   */
  readonly loglevel?: 'silly' | 'verbose' | 'info' | 'silent'

}

/**
 * Rollup plugin to take a list of globs, copy them on the first build,
 * and optionally watch for changes and sync those over afterwards.
 */
export default function globsync(options?: GlobSyncOptions): rollup.Plugin;

