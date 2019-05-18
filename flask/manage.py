# -*- coding: utf-8 -*-
"""
Apply command for user to control flask.
"""
from config import Config, basedir
import os
from app import create_app
from flask_script import Manager, Shell

# 动态创建app实例，然后继续使用
app = create_app(os.getenv('FLASK_CONFIG') or 'default')
# 创建命令行管理
manager = Manager(app, with_default_commands=True)


# 创建数据库迁移管理


# 添加测试命令
@manager.command
def test():
    pass


@manager.command
def update():
    # 自动更新需求库
    print('output requirements file.....')
    os.system('pip freeze > requirements.txt')


# 添加默认执行启动服务器的命令
@manager.command
def default_server():
    app.run(debug=True, host=Config.ACCESSIPS, port=Config.PORT)


# 启动主进程
if __name__ == '__main__':
    manager.run(default_command=default_server.__name__)
