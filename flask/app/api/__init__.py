# -*- coding: utf-8 -*-

from flask import Blueprint
import app

api = Blueprint('api', __name__)
app.fetch_route(api, '/api')

from . import boards
