import type { Plugin } from 'rollup';

export interface RollupPluginGlobSyncOptions {
    /**
     * Array of glob patterns to use for finding files to copy.
     * @default []
     */
    patterns?: string[];

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
     * Whether or not to remove all files within dist when rollup starts up.
     * @default true
     */
    clean?: boolean;

    /**
     * Array of glob patterns to use for finding files to clean.
     * @default dest
     */
    clean_globs?: [];

    /**
     * A (file) => file function that allows for programatically changing the destination of files.
     * @default identify
     */
    transform?: [];

    /**
     * A string defining a package name for the manifest of files to be copied/watched that you can import in your code.
     * @default false
     */
    manifest?: boolean;

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
