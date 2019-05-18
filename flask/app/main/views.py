# -*- coding: utf-8 -*-

from . import main


@main.route('/', methods=['GET'])
def index():
    return 'hello world'
