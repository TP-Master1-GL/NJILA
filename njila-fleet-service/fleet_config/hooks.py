
def postprocess_schema_enrich_with_bearer(result, generator, request, public):
    """
    Force l'affichage du bouton Authorize dans Swagger UI
    en injectant BearerAuth sur chaque opération du schéma.
    """
    # S'assurer que securitySchemes est bien défini
    result.setdefault('components', {})
    result['components'].setdefault('securitySchemes', {})
    result['components']['securitySchemes']['BearerAuth'] = {
        'type': 'http',
        'scheme': 'bearer',
        'bearerFormat': 'JWT',
        'description': 'Entrez votre token JWT au format: Bearer <token>',
    }

    # Supprimer basicAuth et cookieAuth s'ils ont été injectés
    for unwanted in ('basicAuth', 'cookieAuth', 'tokenAuth'):
        result['components']['securitySchemes'].pop(unwanted, None)

    # Appliquer BearerAuth sur chaque endpoint
    for path, methods in result.get('paths', {}).items():
        for method, operation in methods.items():
            if isinstance(operation, dict):
                operation['security'] = [{'BearerAuth': []}]

    # Sécurité globale
    result['security'] = [{'BearerAuth': []}]

    return result