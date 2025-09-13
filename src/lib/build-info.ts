// Auto-generated build information - DO NOT EDIT
// Generated on Sep 13, 2025, 05:13:54 AM GMT+5

export interface BuildInfo {
  version: string;
  buildNumber: string;
  readableVersion: string;
  buildId: string;
  buildDate: string;
  buildDateHuman: string;
  buildTimestamp: number;
  gitCommit: string;
  gitBranch: string;
  gitIsDirty: boolean;
  nodeVersion: string;
  platform: string;
  arch: string;
  buildHost: string;
  buildUser: string;
}

export const BUILD_INFO: BuildInfo = {
  "version": "0.0.1",
  "buildNumber": "1757722434684",
  "readableVersion": "0.0.1.1757722434",
  "buildId": "1757722434-03b9516",
  "buildDate": "2025-09-13T00:13:54.684Z",
  "buildDateHuman": "Sep 13, 2025, 05:13:54 AM GMT+5",
  "buildTimestamp": 1757722434684,
  "gitCommit": "03b9516",
  "gitBranch": "main",
  "gitIsDirty": true,
  "nodeVersion": "v22.15.0",
  "platform": "win32",
  "arch": "x64",
  "buildHost": "cemic",
  "buildUser": "Administrator"
};

// Helper functions
export function getBuildSummary(): string {
  return `v${BUILD_INFO.readableVersion} (${BUILD_INFO.gitCommit}${BUILD_INFO.gitIsDirty ? '-dirty' : ''})`;
}

export function getDetailedBuildInfo(): string {
  return [
    `Version: ${BUILD_INFO.readableVersion}`,
    `Build: ${BUILD_INFO.buildId}`,
    `Date: ${BUILD_INFO.buildDateHuman}`,
    `Git: ${BUILD_INFO.gitBranch}@${BUILD_INFO.gitCommit}${BUILD_INFO.gitIsDirty ? ' (dirty)' : ''}`,
    `Environment: ${BUILD_INFO.platform}/${BUILD_INFO.arch} Node ${BUILD_INFO.nodeVersion}`,
    `Built by: ${BUILD_INFO.buildUser}@${BUILD_INFO.buildHost}`
  ].join('\n');
}

// Make build info available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).buildInfo = BUILD_INFO;
  (window as any).getBuildSummary = getBuildSummary;
  (window as any).getDetailedBuildInfo = getDetailedBuildInfo;
}
