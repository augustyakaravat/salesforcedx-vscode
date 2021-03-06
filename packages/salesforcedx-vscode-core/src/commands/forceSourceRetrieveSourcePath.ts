/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as vscode from 'vscode';

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { PostconditionChecker } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import { SfdxProjectJsonParser } from '../util';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export class ForceSourceRetrieveSourcePathExecutor extends SfdxCommandletExecutor<
  string
> {
  public build(sourcePath: string): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withArg('force:source:retrieve')
      .withFlag('--sourcepath', sourcePath)
      .withLogName('force_source_retrieve_with_sourcepath')
      .build();
  }
}

export class SourcePathChecker implements PostconditionChecker<string> {
  public async check(
    inputs: ContinueResponse<string> | CancelResponse
  ): Promise<ContinueResponse<string> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const sourcePath = inputs.data;
      const sfdxProjectPath = vscode.workspace!.workspaceFolders![0].uri.fsPath;
      const sfdxProjectJsonParser = new SfdxProjectJsonParser();
      try {
        const packageDirectoryPaths = await sfdxProjectJsonParser.getPackageDirectoryPaths(
          sfdxProjectPath
        );
        const fullPackagePaths = packageDirectoryPaths.map(
          packageDirectoryPath =>
            path.join(sfdxProjectPath, packageDirectoryPath)
        );

        let sourcePathIsInPackageDirectory = false;
        for (const packagePath of fullPackagePaths) {
          if (sourcePath.startsWith(packagePath)) {
            sourcePathIsInPackageDirectory = true;
            break;
          }
        }
        if (sourcePathIsInPackageDirectory) {
          return inputs;
        }
      } catch (error) {
        telemetryService.sendError(error.name);
      }

      const errorMessage = nls.localize(
        'error_source_path_not_in_package_directory_text'
      );
      telemetryService.sendError(errorMessage);
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
    }
    return { type: 'CANCEL' };
  }
}

export async function forceSourceRetrieveSourcePath(explorerPath: vscode.Uri) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(explorerPath),
    new ForceSourceRetrieveSourcePathExecutor(),
    new SourcePathChecker()
  );
  await commandlet.run();
}
