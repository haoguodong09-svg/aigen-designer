import cac from 'cac';

import { defineCheckCompiledCommand } from './check-compiled';
// 创建 aigen 实例
const aigen = cac('aigen');

defineCheckCompiledCommand(aigen);

// 解析命令行参数
aigen.parse();