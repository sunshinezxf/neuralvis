# -*- coding: utf-8 -*-

from flask import jsonify


def response_data(code=200, data=None, message=''):
    return jsonify({
        'code': code,
        'data': data,
        'message': message,
    }), code
