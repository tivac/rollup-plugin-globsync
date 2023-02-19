import type { Plugin } from 'rollup';

export interface RollupPluginGlobSyncOptions {
    /**
     * Array of glob patterns to use for finding files to copy.
     */
    globs: string[];

    /**
     * Directory to copy files into.
     * @default ./dist
     */
    dest?: string;

    /**
     * Define the base dir to watch from.
     * @default process.cwd()
     */
    dir?: string;

    /**
     * Whether or not to remove files within dist when rollup starts up, can be an array of glob patterns
     * @default true
     */
    clean?: boolean | string[];

    /**
     * A (file) => file function that allows for programatically changing the destination of files.
     * @default identify
     */
    transform?: boolean | ((source: string) => string);

    /**
     * A string defining a package name for the manifest of files to be copied/watched that you can import in your code.
     * @default false
     */
    manifest?: boolean | string;

    /**
     * A shorthand to enable verbose logging.
     * @default false
     */
    verbose?: boolean;

    /**
     * Specify the exact level to log at.
     * @default info
     */
    loglevel?: 'silly' | 'verbose' | 'info' | 'silent';
}

/**
 * 🍣 A Rollup plugin for copying globs and watching for file changes.
 */
export default function globsync(options?: RollupPluginGlobSyncOptions): Plugin;
