# -*- coding: utf-8 -*-
"""
This config the basedir, security key, database url ...
"""
import os
from datetime import timedelta
import logging

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    # 散列值和安全令牌密钥设置
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'hard to guess string!!!'

    # sqlalchemy的自动提交设置
    SQLALCHEMY_COMMIT_ON_TEARDOWN = True

    # 服务器绑定二级域名 端口 和过滤IP地址设置
    HOST = os.environ.get('WEBSERVER_HOST') or 'localhost'
    PORT = int(os.environ.get('WEBSERVER_PORT') or 5000)
    ACCESSIPS = os.environ.get('WEBSERVER_ACCESSIP') or '0.0.0.0'

    # 超级管理员信息
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

    # 常用常量
    POSTS_PER_PAGE = 30
    USERS_PER_PAGE = 30
    COMMENTS_PER_PAGE = 30
    TAGS_HOT_NUM = 10
    POSTS_ABSTRACT_NUM = 500
    COMMENT_MAX_LEN = 1000

    # SESSION_COOKIE_NAME = 'session'
    PERMANENT_SESSION_LIFETIME = timedelta(days=31)

    UPLOAD_MODEL_FOLDER = 'networks/models/'
    UPLOAD_MODEL_CONVERT_FOLDER = 'networks/models/keras'
    ALLOWED_MODEL_EXTENSIONS = ['h5', 'hdf5']

    UPLOAD_IMAGE_FOLDER = 'networks/images/'
    ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png']

    # logger
    DEFAULT_LOG_FIRENAME = 'logs/log.log'
    LOG_LEVEL = logging.INFO

    # Test dataset
    MNIST_DATA_SET = 'networks/images/mnist'

    # init_app 可以在创建flask应用时，获取到一些app上下文，同时自定义设置参数，一般就是更新app.config吧
    @staticmethod
    def init_app(app):
        app.config['PERMANENT_SESSION_LIFETIME'] = Config.PERMANENT_SESSION_LIFETIME
        handler = logging.FileHandler(os.path.join(basedir, Config.DEFAULT_LOG_FIRENAME), encoding='UTF-8')
        handler.setLevel(Config.LOG_LEVEL)
        logging_format = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(filename)s - %(funcName)s - %(lineno)s - %(message)s'
        )
        handler.setFormatter(logging_format)
        app.logger.addHandler(handler)
        pass


class DevelopmentConfig(Config):
    DEBUG = True
    LOG_LEVEL = logging.DEBUG


class TestingConfig(Config):
    TESTING = True
    WTF_CSRF_ENABLED = False


class ProductionConfig(Config):
    pass


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
