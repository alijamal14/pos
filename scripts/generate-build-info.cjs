const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read package.json
const packageJson = require('../package.json');

// Generate build info
const buildTime = new Date();
const buildTimestamp = Date.now();

// Try to get git information
let gitCommit = 'unknown';
let gitBranch = 'unknown';
let gitIsDirty = false;

try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  
  // Check if working directory is dirty
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  gitIsDirty = gitStatus.length > 0;
} catch (error) {
  console.warn('Git information not available:', error.message);
}

// Generate a more readable version number
const majorVersion = packageJson.version;
const buildNumber = Math.floor(buildTimestamp / 1000); // Seconds since epoch (shorter)
const readableVersion = `${majorVersion}.${buildNumber}`;

// Create comprehensive build info
const buildInfo = {
  // Version information
  version: majorVersion,
  buildNumber: buildTimestamp.toString(),
  readableVersion: readableVersion,
  buildId: `${buildNumber}-${gitCommit}`,
  
  // Timing information
  buildDate: buildTime.toISOString(),
  buildDateHuman: buildTime.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  }),
  buildTimestamp: buildTimestamp,
  
  // Git information
  gitCommit: gitCommit,
  gitBranch: gitBranch,
  gitIsDirty: gitIsDirty,
  
  // Environment information
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  
  // Build metadata
  buildHost: require('os').hostname(),
  buildUser: process.env.USERNAME || process.env.USER || 'unknown'
};

// Generate TypeScript file content
const tsContent = `// Auto-generated build information - DO NOT EDIT
// Generated on ${buildInfo.buildDateHuman}

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

export const BUILD_INFO: BuildInfo = ${JSON.stringify(buildInfo, null, 2)};

// Helper functions
export function getBuildSummary(): string {
  return \`v\${BUILD_INFO.readableVersion} (\${BUILD_INFO.gitCommit}\${BUILD_INFO.gitIsDirty ? '-dirty' : ''})\`;
}

export function getDetailedBuildInfo(): string {
  return [
    \`Version: \${BUILD_INFO.readableVersion}\`,
    \`Build: \${BUILD_INFO.buildId}\`,
    \`Date: \${BUILD_INFO.buildDateHuman}\`,
    \`Git: \${BUILD_INFO.gitBranch}@\${BUILD_INFO.gitCommit}\${BUILD_INFO.gitIsDirty ? ' (dirty)' : ''}\`,
    \`Environment: \${BUILD_INFO.platform}/\${BUILD_INFO.arch} Node \${BUILD_INFO.nodeVersion}\`,
    \`Built by: \${BUILD_INFO.buildUser}@\${BUILD_INFO.buildHost}\`
  ].join('\\n');
}

// Make build info available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).buildInfo = BUILD_INFO;
  (window as any).getBuildSummary = getBuildSummary;
  (window as any).getDetailedBuildInfo = getDetailedBuildInfo;
}
`;

// Write the file
const outputPath = path.join(__dirname, '../src/lib/build-info.ts');
fs.writeFileSync(outputPath, tsContent);

console.log('✅ Generated build info:', buildInfo.buildId);
console.log('📦 Version:', buildInfo.readableVersion);
console.log('🕒 Build time:', buildInfo.buildDateHuman);
if (gitCommit !== 'unknown') {
  console.log('🌿 Git:', `${gitBranch}@${gitCommit}${gitIsDirty ? ' (dirty)' : ''}`);
}