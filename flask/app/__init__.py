# -*- coding: utf-8 -*-

import os
from flask import Flask
from flask_cors import CORS
from config import config, basedir

# 蓝图表，可以动态加载进去
route_list = []


def fetch_route(blueprint, prefix=None):
    tmp_list = [blueprint, prefix]
    route_list.append(tmp_list)


def create_app(config_name):
    app = Flask(__name__)
    CORS(app, supports_credentials=True)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)

    app_dir = os.path.join(basedir, 'app')

    for routes in os.listdir(app_dir):
        route_path = os.path.join(app_dir, routes)
        if (not os.path.isfile(route_path)) and routes != 'static' and routes != 'templates':
            __import__('app.' + routes)
        # 从route_list中引入蓝图
    for blueprints in route_list:
        if blueprints[1] is not None:
            app.register_blueprint(blueprints[0], url_prefix=blueprints[1])
        else:
            app.register_blueprint(blueprints[0])
        # 返回app实例，让外部模块继续使用
    return app
