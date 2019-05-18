# -*- coding: utf-8 -*-

from flask import Blueprint
import app

main = Blueprint('main', __name__)
# 动态加载到app的路由链表中
app.fetch_route(main)

from . import views
