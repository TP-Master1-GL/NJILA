import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "njila_subscribe_service.settings")

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()


def register():
    """Appelé par start.py après setup Django."""
    from django.conf import settings
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from cloud import register_to_eureka
    register_to_eureka(settings.SERVER_PORT)