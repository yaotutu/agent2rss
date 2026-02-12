# 测试文件目录

此目录包含用于测试 Agent2RSS 功能的测试脚本和示例文件。

## 文件说明

### test_upload.sh
文件上传功能测试脚本，用于测试：
- Markdown 文件上传接口
- 多种参数组合
- 错误处理

**使用方法**：
```bash
./tests/test_upload.sh
```

### test_file.md
测试用的 Markdown 示例文件，包含：
- 标题和段落
- 代码块
- 列表
- 链接

## 添加新测试

在此目录下创建新的测试脚本或测试文件：

```bash
# 创建新测试脚本
touch tests/test_new_feature.sh
chmod +x tests/test_new_feature.sh

# 创建测试数据文件
touch tests/test_data.md
```

## 注意事项

- 测试文件（`test_*.md`）和日志文件（`*.log`）会被 Git 忽略
- 测试脚本需要添加执行权限：`chmod +x tests/your_script.sh`
- 运行测试前确保服务器已启动：`bun run dev`
