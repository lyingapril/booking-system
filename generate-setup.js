const fs = require('fs');
const path = require('path');

// 要排除的文件和目录（支持相对路径和通配符）
const exclude = [
  'node_modules', 
  '.git', 
  'setup-project.js', 
  'generate-setup.js',
  'database', // 排除数据库文件
  'dist', 'build', // 排除构建产物
  '.env', '.gitignore', '.idea', '.vscode', // 排除配置和隐藏文件
  'backend/database',
  'backend/node_modules',
  'backend/package-lock.json',
  'frontend/node_modules',
  'frontend/package-lock.json'
];

// 判断是否应该排除某个路径
const shouldExclude = (relativePath) => {
  // 将路径标准化（统一使用正斜杠，处理不同系统的路径分隔符）
  const normalizedPath = relativePath.replace(/\\/g, '/');
  
  // 检查是否匹配任何排除模式
  return exclude.some(pattern => {
    // 模式也标准化
    const normalizedPattern = pattern.replace(/\\/g, '/');
    
    // 完全匹配
    if (normalizedPath === normalizedPattern) {
      return true;
    }
    
    // 检查是否为子目录（如 backend/node_modules 下的所有内容）
    if (normalizedPattern.endsWith('/')) {
      return normalizedPath.startsWith(normalizedPattern);
    }
    
    // 检查是否为路径的一部分（如 node_modules 目录，无论在哪个层级）
    if (normalizedPattern.includes('/')) {
      return normalizedPath.startsWith(normalizedPattern);
    } else {
      // 简单名称，检查是否在路径的任何部分
      return normalizedPath.split('/').includes(normalizedPattern);
    }
  });
};

// 递归构建目录结构对象
const buildStructure = (dir, baseDir = dir) => {
  const structure = {};
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (shouldExclude(relativePath)) {
      continue;
    }
    
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      structure[file] = buildStructure(fullPath, baseDir);
    } else {
      try {
        // 读取文件内容
        const content = fs.readFileSync(fullPath, 'utf8');
        structure[file] = content;
      } catch (err) {
        console.warn(`无法读取文件 ${fullPath}，将被忽略:`, err.message);
      }
    }
  }
  
  return structure;
};

// 生成setup-project.js内容
const generateSetupScript = (structure) => {
  return `const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const execSync = childProcess.execSync;

// 项目结构定义
const projectStructure = ${JSON.stringify(structure, null, 2)};

// 创建目录和文件的函数
function createStructure(basePath, structure) {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = path.join(basePath, name);
    
    if (typeof content === 'object' && content !== null) {
      // 创建目录
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(\`创建目录: \${fullPath}\`);
      }
      createStructure(fullPath, content);
    } else {
      // 创建文件
      fs.writeFileSync(fullPath, content);
      console.log(\`创建文件: \${fullPath}\`);
    }
  }
}

// 执行命令并显示进度
function runCommand(command, cwd, description) {
  try {
    console.log(\`开始\${description}...\`);
    execSync(command, { cwd, stdio: 'inherit' });
    console.log(\`\${description}完成\`);
  } catch (error) {
    console.error(\`\${description}失败:\`, error.message);
    console.error('你可以尝试手动安装依赖：');
    console.error(\`1. 后端：cd backend && npm install\`);
    console.error(\`2. 前端：cd frontend && npm install\`);
    process.exit(1);
  }
}

// 主函数
async function main() {
  try {
    console.log('开始创建项目结构...');
    createStructure(process.cwd(), projectStructure);
    console.log('项目结构创建完成！');

    // 如果存在后端目录，安装依赖
    if (fs.existsSync(path.join(process.cwd(), 'backend'))) {
      runCommand(
        'npm install', 
        path.join(process.cwd(), 'backend'), 
        '安装后端依赖'
      );
    }

    // 如果存在前端目录，安装依赖
    if (fs.existsSync(path.join(process.cwd(), 'frontend'))) {
      runCommand(
        'npm install', 
        path.join(process.cwd(), 'frontend'), 
        '安装前端依赖'
      );
    }

    // 如果存在种子脚本，执行它
    const seedScript = path.join(process.cwd(), 'backend', 'seed-services.js');
    if (fs.existsSync(seedScript)) {
      runCommand(
        'node seed-services.js', 
        path.join(process.cwd(), 'backend'), 
        '初始化服务示例数据'
      );
    }

    console.log('\\n所有操作完成！');
    console.log('可以通过以下命令启动服务：');
    console.log('1. 启动后端服务: cd backend && npm run dev');
    console.log('2. 启动前端服务: 打开新终端，cd frontend && npm run serve');
  } catch (err) {
    console.error('创建项目时出错:', err.message);
    process.exit(1);
  }
}

// 执行主函数
main();
`;
};

// 主流程
try {
  console.log('开始扫描当前目录结构...');
  const projectStructure = buildStructure(process.cwd());
  
  console.log('生成setup-project.js文件...');
  const setupScriptContent = generateSetupScript(projectStructure);
  
  fs.writeFileSync('setup-project.js', setupScriptContent, 'utf8');
  console.log('setup-project.js已生成成功！');
} catch (err) {
  console.error('生成脚本时出错:', err.message);
  process.exit(1);
}
