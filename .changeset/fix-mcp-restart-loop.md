---
"kilo-code": patch
---

Fix MCP server restart loop when installing/removing marketplace items

When installing or removing MCP servers from the marketplace, the file watcher would detect the settings file change and trigger an unnecessary server restart. This fix sets the isProgrammaticUpdate flag before writing to MCP settings files, which tells the file watcher to ignore these programmatic changes.
